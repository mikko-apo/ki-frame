import { describe, expect, it } from "vitest";
import { Channel } from "../channel";

describe(Channel, () => {
  it(".subscribe() + .publish() + .unsubscribe()", () => {
    const channel = new Channel("test");
    let c = 0;
    const unsub = channel.subscribe(() => {
      c = c + 1;
    });
    channel.publish();
    expect(c).eq(1);
    channel.publish();
    expect(c).eq(2);
    unsub();
    channel.publish();
    expect(c).eq(2);
    unsub();
    channel.publish();
    expect(c).eq(2);
  });
  it(".subscribeFn() + .destroy()", () => {
    const channel = new Channel<[string]>("test");
    const subFn = channel.subscribeFn();
    let c = "1";
    subFn((s) => {
      c = s;
    });
    channel.publish("test");
    expect(c).eq("test");
    channel.destroy();
    channel.publish("test2");
    expect(c).eq("test");
  });
  it(".once()", () => {
    const channel = new Channel<[number]>("test");
    let c = 0;
    const subFn = channel.once((args) => {
      c = args;
    });
    channel.publish(2);
    expect(c).eq(2);
    channel.publish(3);
    expect(c).eq(2);
  });
});
