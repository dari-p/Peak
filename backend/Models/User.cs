namespace backend.Models;

public class User
{
    public int Id { get; set; }

    public required string Email { get; set; }

    public required string NormalizedEmail { get; set; }

    public required string PasswordHash { get; set; }

    public required string Name { get; set; }

    public int Age { get; set; }

    public decimal WeightKg { get; set; }

    public decimal HeightCm { get; set; }

    public required string Sex { get; set; }

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
