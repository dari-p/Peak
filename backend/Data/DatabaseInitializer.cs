using Microsoft.EntityFrameworkCore;

namespace backend.Data;

public static class DatabaseInitializer
{
    public static void Initialize(AppDbContext db)
    {
        db.Database.EnsureCreated();
        AddMissingUserColumns(db);
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
}
