-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_OperationLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "detail" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OperationLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_OperationLog" ("action", "createdAt", "detail", "entityId", "entityType", "id", "userId") SELECT "action", "createdAt", "detail", "entityId", "entityType", "id", "userId" FROM "OperationLog";
DROP TABLE "OperationLog";
ALTER TABLE "new_OperationLog" RENAME TO "OperationLog";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
