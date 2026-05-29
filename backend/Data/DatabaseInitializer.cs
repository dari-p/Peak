using Microsoft.EntityFrameworkCore;

namespace backend.Data;

public static class DatabaseInitializer
{
    public static void Initialize(AppDbContext db)
    {
        db.Database.EnsureCreated();
        AddMissingUserColumns(db);
        EnsureFitnessStateTable(db);
    }

    private static void AddMissingUserColumns(AppDbContext db)
    {
        var columns = db.Database
            .SqlQueryRaw<string>("SELECT name AS Value FROM pragma_table_info('Users')")
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        if (!columns.Contains("Name"))
        {
            db.Database.ExecuteSqlRaw("ALTER TABLE Users ADD COLUMN Name TEXT NOT NULL DEFAULT ''");
        }

        if (!columns.Contains("Age"))
        {
            db.Database.ExecuteSqlRaw("ALTER TABLE Users ADD COLUMN Age INTEGER NOT NULL DEFAULT 0");
        }

        if (!columns.Contains("WeightKg"))
        {
            db.Database.ExecuteSqlRaw("ALTER TABLE Users ADD COLUMN WeightKg TEXT NOT NULL DEFAULT '0.0'");
        }

        if (!columns.Contains("HeightCm"))
        {
            db.Database.ExecuteSqlRaw("ALTER TABLE Users ADD COLUMN HeightCm TEXT NOT NULL DEFAULT '0.0'");
        }

        if (!columns.Contains("Sex"))
        {
            db.Database.ExecuteSqlRaw("ALTER TABLE Users ADD COLUMN Sex TEXT NOT NULL DEFAULT 'not_specified'");
        }
    }

    private static void EnsureFitnessStateTable(AppDbContext db)
    {
        db.Database.ExecuteSqlRaw("""
            CREATE TABLE IF NOT EXISTS UserFitnessStates (
                Id INTEGER NOT NULL CONSTRAINT PK_UserFitnessStates PRIMARY KEY AUTOINCREMENT,
                UserId INTEGER NOT NULL,
                RoutinesJson TEXT NOT NULL DEFAULT '[]',
                HistoryJson TEXT NOT NULL DEFAULT '[]',
                UpdatedAt TEXT NOT NULL,
                CONSTRAINT FK_UserFitnessStates_Users_UserId FOREIGN KEY (UserId) REFERENCES Users (Id) ON DELETE CASCADE
            )
        """);

        db.Database.ExecuteSqlRaw("""
            CREATE UNIQUE INDEX IF NOT EXISTS IX_UserFitnessStates_UserId
            ON UserFitnessStates (UserId)
        """);
    }
}
