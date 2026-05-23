using backend.Models;

namespace backend.Dtos;

public record AuthResponse(string Token, DateTime ExpiresAt, UserResponse User);

public record UserResponse(
    int Id,
    string Email,
    string Name,
    int Age,
    decimal WeightKg,
    decimal HeightCm,
    string Sex,
    DateTimeOffset CreatedAt)
{
    public static UserResponse FromUser(User user)
    {
        return new UserResponse(
            user.Id,
            user.Email,
            user.Name,
            user.Age,
            user.WeightKg,
            user.HeightCm,
            user.Sex,
            user.CreatedAt);
    }
}
