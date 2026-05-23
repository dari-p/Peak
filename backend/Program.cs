using backend.Data;
using backend.Dtos;
using backend.Models;
using backend.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.Security.Claims;
using System.Text;

var builder = WebApplication.CreateBuilder(args);

builder.Logging.ClearProviders();
builder.Logging.AddConsole();

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlite(builder.Configuration.GetConnectionString("DefaultConnection")));

builder.Services.AddScoped<JwtService>();

var jwtKey = builder.Configuration["Jwt:Key"]
    ?? throw new InvalidOperationException("Jwt:Key is missing from configuration.");

builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = builder.Configuration["Jwt:Issuer"],
            ValidAudience = builder.Configuration["Jwt:Audience"],
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey))
        };
    });

builder.Services.AddAuthorization();

builder.Services.AddCors(options =>
{
    options.AddPolicy("Frontend", policy =>
    {
        var allowedOrigins = new[]
        {
            "http://localhost:4173",
            "http://127.0.0.1:4173",
            "http://localhost:5500",
            "http://127.0.0.1:5500"
        };

        policy
            .SetIsOriginAllowed(origin => origin == "null" || allowedOrigins.Contains(origin))
            .AllowAnyHeader()
            .AllowAnyMethod();
    });
});

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    DatabaseInitializer.Initialize(db);
}

app.UseCors("Frontend");
app.UseAuthentication();
app.UseAuthorization();

app.MapGet("/", () => Results.Ok(new { message = "Peak API is running" }));

var allowedSexValues = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
{
    "female",
    "male",
    "non_binary",
    "prefer_not_to_say"
};

app.MapPost("/auth/register", async (RegisterRequest request, AppDbContext db, JwtService jwtService) =>
{
    var email = NormalizeEmail(request.Email);
    var name = request.Name?.Trim() ?? string.Empty;
    var sex = NormalizeSex(request.Sex);

    if (string.IsNullOrWhiteSpace(email))
    {
        return Results.BadRequest(new { message = "Email is required." });
    }

    if (string.IsNullOrWhiteSpace(name))
    {
        return Results.BadRequest(new { message = "Name is required." });
    }

    if (string.IsNullOrWhiteSpace(request.Password) || request.Password.Length < 8)
    {
        return Results.BadRequest(new { message = "Password must be at least 8 characters." });
    }

    if (request.Age is null or < 13 or > 100)
    {
        return Results.BadRequest(new { message = "Age must be between 13 and 100." });
    }

    if (request.WeightKg is null or <= 0 or > 500)
    {
        return Results.BadRequest(new { message = "Weight must be between 1 and 500 kg." });
    }

    if (request.HeightCm is null or <= 0 or > 260)
    {
        return Results.BadRequest(new { message = "Height must be between 1 and 260 cm." });
    }

    if (!allowedSexValues.Contains(sex))
    {
        return Results.BadRequest(new { message = "Sex is invalid." });
    }

    var userExists = await db.Users.AnyAsync(user => user.NormalizedEmail == email);

    if (userExists)
    {
        return Results.Conflict(new { message = "A user with this email already exists." });
    }

    var user = new User
    {
        Email = email,
        NormalizedEmail = email,
        PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password),
        Name = name,
        Age = request.Age.Value,
        WeightKg = request.WeightKg.Value,
        HeightCm = request.HeightCm.Value,
        Sex = sex
    };

    db.Users.Add(user);
    await db.SaveChangesAsync();

    return Results.Created($"/users/{user.Id}", jwtService.CreateAuthResponse(user));
});

app.MapPost("/auth/login", async (LoginRequest request, AppDbContext db, JwtService jwtService) =>
{
    var email = NormalizeEmail(request.Email);

    if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(request.Password))
    {
        return Results.BadRequest(new { message = "Email and password are required." });
    }

    var user = await db.Users.SingleOrDefaultAsync(user => user.NormalizedEmail == email);

    if (user is null || !BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash))
    {
        return Results.Unauthorized();
    }

    return Results.Ok(jwtService.CreateAuthResponse(user));
});

app.MapGet("/auth/me", async (ClaimsPrincipal principal, AppDbContext db) =>
{
    var userIdValue = principal.FindFirstValue(ClaimTypes.NameIdentifier);

    if (!int.TryParse(userIdValue, out var userId))
    {
        return Results.Unauthorized();
    }

    var user = await db.Users.FindAsync(userId);

    return user is null
        ? Results.NotFound()
        : Results.Ok(UserResponse.FromUser(user));
}).RequireAuthorization();

app.Run();

static string NormalizeEmail(string? email)
{
    return email?.Trim().ToLowerInvariant() ?? string.Empty;
}

static string NormalizeSex(string? sex)
{
    return sex?.Trim().ToLowerInvariant() ?? string.Empty;
}
