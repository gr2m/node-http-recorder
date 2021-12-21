import { test } from "uvu";
import * as assert from "uvu/assert";

import HttpRecorder from "./index.js";

test("smoke", () => {
  assert.instance(HttpRecorder, Function);
});
