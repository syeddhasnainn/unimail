import { Config, Context, Effect, Layer, Redacted, Schema } from "effect"
import { decryptWith } from "../server/cipher.server"

export class CryptoError extends Schema.TaggedError<CryptoError>()("CryptoError", {
  cause: Schema.Defect(),
}) {}

export class MailCrypto extends Context.Service<
  MailCrypto,
  {
    decrypt(payload: string): Effect.Effect<Redacted.Redacted<string>, CryptoError>
  }
>()("unimail/sync/MailCrypto") {
  static readonly layer = Layer.effect(
    MailCrypto,
    Effect.gen(function* () {
      const secret = yield* Config.Redacted("UNIMAIL_SECRET")

      const decrypt = Effect.fn("MailCrypto.decrypt")((payload: string) =>
        Effect.try({
          try: () => Redacted.make(decryptWith(Redacted.value(secret), payload)),
          catch: (cause) => new CryptoError({ cause }),
        }),
      )

      return MailCrypto.of({ decrypt })
    }),
  )
}
