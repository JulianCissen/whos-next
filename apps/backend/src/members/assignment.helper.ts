export type AddMutation = {
  type: 'ADD';
  /** 1-indexed position where the new member is inserted */
  insertedAt: number;
};

export type RemoveMutation = {
  type: 'REMOVE';
  /** 1-indexed position of the removed member (before removal) */
  removedAt: number;
};

export type ReorderMutation = {
  type: 'REORDER';
  /**
   * 1-indexed position of the member that was "current next"
   * in the newly-ordered queue (i.e. the new position of the
   * member previously at `currentNextIndex + 1`).
   */
  newPositionOfCurrentNext: number;
};

export type QueueMutation = AddMutation | RemoveMutation | ReorderMutation;

/**
 * Derives the new `nextIndex` (0-based) after a queue mutation.
 *
 * Rules (from research.md Decision 8):
 *   ADD  at P (0-based) <= nextIndex, non-empty queue → nextIndex + 1
 *   ADD  at P (0-based) >  nextIndex                 → unchanged
 *   ADD  to empty queue                              → unchanged
 *   REMOVE at P <  nextIndex → nextIndex - 1
 *   REMOVE at P == nextIndex → nextIndex % max(newLength, 1)
 *   REMOVE at P >  nextIndex → unchanged
 *   REORDER                  → newPositionOfCurrentNext - 1  (convert to 0-based)
 *
 * @param currentNextIndex  Current 0-based nextIndex.
 * @param queueLengthBefore Number of active members before the mutation.
 * @param mutation          Description of what changed.
 */
export function adjustNextIndex(
  currentNextIndex: number,
  queueLengthBefore: number,
  mutation: QueueMutation,
): number {
  switch (mutation.type) {
    case 'ADD': {
      if (queueLengthBefore === 0) return currentNextIndex;
      const insertedAtZeroBased = mutation.insertedAt - 1;
      return insertedAtZeroBased <= currentNextIndex ? currentNextIndex + 1 : currentNextIndex;
    }

    case 'REMOVE': {
      const removedAtZeroBased = mutation.removedAt - 1;
      const newLength = queueLengthBefore - 1;
      if (removedAtZeroBased < currentNextIndex) return currentNextIndex - 1;
      if (removedAtZeroBased === currentNextIndex) return currentNextIndex % Math.max(newLength, 1);
      return currentNextIndex;
    }

    case 'REORDER': {
      return mutation.newPositionOfCurrentNext - 1;
    }
  }
}
