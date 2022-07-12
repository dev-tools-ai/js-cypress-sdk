type Iterableify<T> = { [K in keyof T]: Iterable<T[K]> };

export function* zip<T extends Array<any>>(
  ...toZip: Iterableify<T>
): Generator<T> {
  const iterators = toZip.map((i) => i[Symbol.iterator]());
  while (true) {
    const results = iterators.map((i) => i.next());
    if (results.some(({ done }) => done)) {
      break;
    }
    yield results.map(({ value }) => value) as T;
  }
}
