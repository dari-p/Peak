namespace backend.Dtos;

public record RegisterRequest(
    string? Email,
    string? Password,
    string? Name,
    int? Age,
    decimal? WeightKg,
    decimal? HeightCm,
    string? Sex);
