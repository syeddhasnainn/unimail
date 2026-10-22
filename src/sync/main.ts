import { NodeRuntime } from "@effect/platform-node"
import { Layer } from "effect"
import { Classifier } from "./Classifier"
import { Database } from "./Database"
import { MailCrypto } from "./MailCrypto"
import { Supervisor } from "./Supervisor"
import { SyncRequests } from "./SyncRequests"

const MainLayer = Layer.mergeAll(Supervisor, Classifier).pipe(
  Layer.provide(SyncRequests.layer),
  Layer.provide(Layer.mergeAll(Database.layer, MailCrypto.layer)),
)

Layer.launch(MainLayer).pipe(NodeRuntime.runMain)
