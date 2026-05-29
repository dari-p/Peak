using backend.Models;
using Microsoft.EntityFrameworkCore;

namespace backend.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<User> Users => Set<User>();

    public DbSet<UserFitnessState> UserFitnessStates => Set<UserFitnessState>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<User>(entity =>
        {
            entity.HasIndex(user => user.NormalizedEmail).IsUnique();
            entity.Property(user => user.Email).HasMaxLength(254);
            entity.Property(user => user.NormalizedEmail).HasMaxLength(254);
            entity.Property(user => user.PasswordHash).HasMaxLength(128);
            entity.Property(user => user.Name).HasMaxLength(100);
            entity.Property(user => user.Sex).HasMaxLength(30);
        });

        modelBuilder.Entity<UserFitnessState>(entity =>
        {
            entity.HasIndex(state => state.UserId).IsUnique();
            entity.Property(state => state.RoutinesJson).HasDefaultValue("[]");
            entity.Property(state => state.HistoryJson).HasDefaultValue("[]");
            entity.HasOne(state => state.User)
                .WithOne()
                .HasForeignKey<UserFitnessState>(state => state.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });
    }
}
