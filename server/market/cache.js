/**
 * Zwischenspeicher für Marktdaten.
 *
 * Drei Eigenschaften machen den Unterschied zwischen "läuft" und "läuft auch
 * am schlechten Tag":
 *
 *   Verfallszeit   - ein Wert gilt eine Zeit lang als frisch und wird in
 *                    dieser Zeit nicht erneut abgerufen.
 *   Mindestabstand - zwischen zwei Abrufen derselben Quelle liegt eine
 *                    Mindestzeit. Tankerkönig erlaubt eine Abfrage je fünf
 *                    Minuten; ohne diese Bremse sperrt der Schlüssel.
 *   Rückfall       - der letzte erfolgreiche Wert bleibt erhalten. Ist die
 *                    Quelle nicht erreichbar, rechnet die Anwendung mit dem
 *                    alten Wert weiter und sagt, wie alt er ist.
 */

export function createStore({ ttlMs, minIntervalMs = 0, now = () => Date.now() }) {
  const entries = new Map();
  // Minus unendlich, nicht null: der erste Abruf darf nie an der
  // Abstandsbremse hängenbleiben, auch nicht bei einer gestellten Uhr.
  let lastAttempt = -Infinity;

  return {
    /** Wert, sofern er noch innerhalb der Verfallszeit liegt. */
    fresh(key) {
      const entry = entries.get(key);
      if (!entry) return null;
      return now() - entry.fetchedAt <= ttlMs ? entry : null;
    },
    /** Letzter erfolgreicher Wert, unabhängig vom Alter. */
    stale(key) {
      return entries.get(key) || null;
    },
    set(key, value) {
      const entry = { value, fetchedAt: now() };
      entries.set(key, entry);
      return entry;
    },
    mayFetch() {
      return now() - lastAttempt >= minIntervalMs;
    },
    noteAttempt() {
      lastAttempt = now();
    },
    get size() {
      return entries.size;
    },
  };
}

/**
 * Holt einen Wert über den Zwischenspeicher. Reihenfolge: frischer Wert,
 * eigener Abruf, letzter Erfolg. Erst wenn es nichts davon gibt, kommt null
 * zurück - die Anwendung rechnet dann mit den eingetragenen Werten weiter.
 */
export async function resolve(store, key, loader, { onError } = {}) {
  const fresh = store.fresh(key);
  if (fresh) return { value: fresh.value, fetchedAt: fresh.fetchedAt, stale: false };

  if (!store.mayFetch()) {
    const previous = store.stale(key);
    if (previous) {
      return {
        value: previous.value,
        fetchedAt: previous.fetchedAt,
        stale: true,
        note: 'Mindestabstand zwischen zwei Abrufen noch nicht erreicht.',
      };
    }
    return null;
  }

  store.noteAttempt();
  try {
    const value = await loader();
    const entry = store.set(key, value);
    return { value: entry.value, fetchedAt: entry.fetchedAt, stale: false };
  } catch (err) {
    onError?.(err);
    const previous = store.stale(key);
    if (previous) {
      return {
        value: previous.value,
        fetchedAt: previous.fetchedAt,
        stale: true,
        note: `Quelle nicht erreichbar (${err.message}), letzter bekannter Wert.`,
      };
    }
    return null;
  }
}
