import { describe, it } from "mocha";
import { Position, TickArray, Whirlpool } from "../../client/src";
import { PositionFacade, TickArrayFacade, WhirlpoolFacade } from "../dist/nodejs/orca_whirlpools_core_js_bindings";

// Since these tests are only for type checking, nothing actually happens at runtime.

// FIXME: check if tests actually fail compiling if the types don't match (or if it just passes silently)

describe("WASM exported types match Kinobi types", () => {

  it("Whirlpool", async () => {
    const fauxWhirlpool = {} as Whirlpool;
    fauxWhirlpool satisfies WhirlpoolFacade;
  });

  it("Position", async () => {
    const fauxPosition = {} as Position;
    fauxPosition satisfies PositionFacade;
  });

  it("TickArray", async () => {
    const fauxTickArray = {} as TickArray;
    fauxTickArray satisfies TickArrayFacade;
  });
})
