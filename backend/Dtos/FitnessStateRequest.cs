namespace backend.Dtos;

public record FitnessStateRequest(string? RoutinesJson, string? HistoryJson);

public record FitnessStateResponse(string RoutinesJson, string HistoryJson, DateTimeOffset UpdatedAt);
