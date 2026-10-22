import { OpenRouterClient, OpenRouterLanguageModel } from "@effect/ai-openrouter"
import { Array as Arr, Config, Effect, Layer, Option, Schedule, Schema } from "effect"
import { AiError, LanguageModel } from "effect/ai"
import { FetchHttpClient } from "effect/http"
import { CATEGORIES, CATEGORY_IDS } from "../lib/categories"
import {
  bumpVersion,
  learnedCategory,
  pendingClassification,
  recentCorrections,
  restoreClassifications,
  saveClassifications,
} from "../server/db/store.server"
import type { ClassificationResult } from "../server/db/store.server"
import { Database } from "./Database"

const MODEL = "anthropic/claude-haiku-5.5"
const BATCH_SIZE = 10
const CONCURRENCY = 3
const EXCERPT_HEAD = 1200
const EXCERPT_TAIL = 300

const Classification = Schema.Struct({
  results: Schema.Array(
    Schema.Struct({
      id: Schema.Number,
      category: Schema.Literals(CATEGORY_IDS),
      reason: Schema.String,
    }),
  ),
})

const NON_RETRYABLE_OUTPUT_ERRORS = new Set([
  "InvalidOutputError",
  "StructuredOutputError",
  "ContentPolicyError",
  "InvalidRequestError",
])

type PendingMessage = ReturnType<typeof pendingClassification>[number]

const SYSTEM_PROMPT = `You sort incoming email for a busy founder who runs several businesses, each with its own mailbox.
Assign every email exactly one category:

${CATEGORY_IDS.map((id) => `- ${id}: ${CATEGORIES[id].description}`).join("\n")}

When an email could fit more than one category, prefer the one that best predicts how the user will treat it.
A pitch from a stranger is cold_outreach even when it is polite, personalized, or mentions the user's work.
"Prior contact" says how many times the user has emailed the sender. A reply to outreach the user started (prior contact above 0) is important, even when it quotes a price, because the user is waiting for it.
Automated mail about the user's own accounts is notification, unless it is about money, which is billing.
For each email, give a reason of at most 12 words that names the concrete signal you relied on.
Return one result per email id you were given.`

function excerpt(message: PendingMessage) {
  const text = (message.text ?? message.snippet).replace(/\s+/g, " ").trim()
  if (text.length <= EXCERPT_HEAD + EXCERPT_TAIL) return text
  return `${text.slice(0, EXCERPT_HEAD)} … ${text.slice(-EXCERPT_TAIL)}`
}

function renderEmail(message: PendingMessage) {
  const from = message.fromName ? `${message.fromName} <${message.fromAddress}>` : (message.fromAddress ?? "unknown")
  const to = message.to.map((t) => t.address).join(", ")
  return `<email id="${message.id}">
Mailbox: ${message.accountEmail}
From: ${from}
To: ${to}
Prior contact: ${message.sentToSender}
Date: ${message.date.toISOString()}
Subject: ${message.subject}
Body: ${excerpt(message)}
</email>`
}

function renderCorrections(corrections: ReturnType<typeof recentCorrections>) {
  if (corrections.length === 0) return ""
  const lines = corrections.map((c) => `- ${c.fromAddress ?? "unknown"} | "${c.subject}" -> ${c.category}`)
  return `The user has corrected these emails before. Apply the same judgement to similar senders and messages:\n${lines.join("\n")}\n\n`
}

const ClassifierWorker = Layer.effectDiscard(
  Effect.gen(function* () {
    const database = yield* Database
    const model = yield* LanguageModel.LanguageModel

    const classifyWithModel = Effect.fn("Classifier.classifyWithModel")(function* (
      batch: ReadonlyArray<PendingMessage>,
    ) {
      const corrections = yield* database.use((db) => recentCorrections(db, 20))
      const response = yield* model.generateObject({
        objectName: "email_categories",
        schema: Classification,
        prompt: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: `${renderCorrections(corrections)}Classify these ${batch.length} emails:\n\n${batch.map(renderEmail).join("\n\n")}`,
          },
        ],
      })
      const byId = new Map(response.value.results.map((r) => [r.id, r]))
      const results: ClassificationResult[] = []
      const failed: number[] = []
      for (const message of batch) {
        const result = byId.get(message.id)
        if (result) results.push({ id: message.id, category: result.category, reason: result.reason, source: "ai" })
        else failed.push(message.id)
      }
      yield* database.use((db) => {
        saveClassifications(db, results, failed)
        bumpVersion(db)
      })
    })

    const classifyBatch = (batch: ReadonlyArray<PendingMessage>) =>
      classifyWithModel(batch).pipe(
        Effect.catchIf(
          (error): error is AiError.AiError =>
            AiError.isAiError(error) && NON_RETRYABLE_OUTPUT_ERRORS.has(error.reason._tag),
          (error) =>
            Effect.logWarning(`Classification failed for ${batch.length} emails: ${error.reason._tag}`).pipe(
              Effect.andThen(
                database.use((db) =>
                  saveClassifications(
                    db,
                    [],
                    batch.map((m) => m.id),
                  ),
                ),
              ),
            ),
        ),
      )

    const round = Effect.gen(function* () {
      const restored = yield* database.use(restoreClassifications)
      if (restored > 0) {
        yield* database.use(bumpVersion)
        yield* Effect.logInfo(`Reused ${restored} saved classifications`)
      }
      const pending = yield* database.use((db) => pendingClassification(db, BATCH_SIZE * CONCURRENCY))
      if (pending.length === 0) return 0

      const learned = yield* database.use((db) =>
        pending.flatMap((message): ClassificationResult[] => {
          const category = learnedCategory(db, message.fromAddress)
          return category
            ? [{ id: message.id, category, reason: "Learned from your correction", source: "sender" }]
            : []
        }),
      )
      if (learned.length) yield* database.use((db) => saveClassifications(db, learned, []))

      const learnedIds = new Set(learned.map((l) => l.id))
      const remaining = pending.filter((message) => !learnedIds.has(message.id))
      yield* Effect.forEach(Arr.chunksOf(remaining, BATCH_SIZE), classifyBatch, {
        concurrency: CONCURRENCY,
        discard: true,
      })
      yield* Effect.logInfo(`Classified ${pending.length} emails`)
      return pending.length
    })

    yield* round.pipe(
      Effect.flatMap((count) => (count === 0 ? Effect.sleep("5 seconds") : Effect.void)),
      Effect.forever,
      Effect.tapError((error) => Effect.logWarning("Classifier paused after an error", error)),
      Effect.retry(Schedule.min([Schedule.exponential("10 seconds"), Schedule.spaced("5 minutes")])),
      Effect.forkScoped,
    )
    yield* Effect.logInfo(`Email classifier started (${MODEL})`)
  }),
)

const ModelLayer = OpenRouterLanguageModel.layer({
  model: MODEL,
  config: {
    provider: { only: ["anthropic"], allow_fallbacks: false },
    reasoning: { effort: "low" },
    max_tokens: 4000,
    strictJsonSchema: true,
  },
}).pipe(
  Layer.provide(OpenRouterClient.layerConfig({ apiKey: Config.Redacted("OPENROUTER_API_KEY") })),
  Layer.provide(FetchHttpClient.layer),
)

export const Classifier = Layer.unwrap(
  Effect.gen(function* () {
    const apiKey = yield* Config.Redacted("OPENROUTER_API_KEY").pipe(Config.option)
    if (Option.isNone(apiKey)) {
      return Layer.effectDiscard(Effect.logWarning("OPENROUTER_API_KEY is not set, email classification is off"))
    }
    return ClassifierWorker.pipe(Layer.provide(ModelLayer))
  }),
)
