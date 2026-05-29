namespace backend.Models;

public class UserFitnessState
{
    public int Id { get; set; }

    public int UserId { get; set; }

    public required string RoutinesJson { get; set; }

    public required string HistoryJson { get; set; }

    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;

    public User? User { get; set; }
}
