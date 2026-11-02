// One question at a time, because a small model on this PC slows everyone down otherwise.
// Counted per server process, so more web servers would need this moved to Redis.
const queue: (() => void)[] = [];
let busy = false;

function next() {
  const start = queue.shift();
  if (start) start();
  else busy = false;
}

/** Resolves when it's this question's turn, with the function that gives the turn back. */
export function waitForTurn(onWaiting: (ahead: number) => void, signal?: AbortSignal): Promise<() => void> {
  const release = () => next();
  if (!busy) {
    busy = true;
    return Promise.resolve(release);
  }
  onWaiting(queue.length + 1);
  return new Promise((resolve) => {
    const start = () => resolve(release);
    queue.push(start);
    signal?.addEventListener(
      "abort",
      () => {
        // Gone before its turn: leave the line, and hand back an empty release.
        const index = queue.indexOf(start);
        if (index >= 0) {
          queue.splice(index, 1);
          resolve(() => {});
        }
      },
      { once: true },
    );
  });
}
