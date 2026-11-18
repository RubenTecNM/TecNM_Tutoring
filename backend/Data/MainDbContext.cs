using Microsoft.EntityFrameworkCore;
using TecNM.Api.Core.Entities;

namespace TecNM.Api.Data;

/// <summary>BD Principal (tecnm_main). Solo lectura: sin tracking y sin SaveChanges.</summary>
public sealed class MainDbContext(DbContextOptions<MainDbContext> options) : DbContext(options)
{
    public DbSet<Student> Students => Set<Student>();
    public DbSet<Teacher> Teachers => Set<Teacher>();

    protected override void OnConfiguring(DbContextOptionsBuilder optionsBuilder) =>
        optionsBuilder.UseQueryTrackingBehavior(QueryTrackingBehavior.NoTracking);

    public override int SaveChanges(bool acceptAllChangesOnSuccess) =>
        throw new InvalidOperationException("MainDbContext es de solo lectura.");

    public override Task<int> SaveChangesAsync(
        bool acceptAllChangesOnSuccess,
        CancellationToken cancellationToken = default) =>
        throw new InvalidOperationException("MainDbContext es de solo lectura.");

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        var student = modelBuilder.Entity<Student>();
        student.ToTable("alumnos");
        student.HasKey(item => item.EnrollmentNumber).HasName("pk_alumnos");
        student.Property(item => item.EnrollmentNumber).HasColumnName("matricula").HasMaxLength(12);
        student.Property(item => item.LastNames).HasColumnName("apellidos").HasMaxLength(50);
        student.Property(item => item.FirstName).HasColumnName("nombre").HasMaxLength(50);
        student.Property(item => item.Sex).HasColumnName("sexo").HasMaxLength(1);
        student.Property(item => item.Semester).HasColumnName("semestre");
        student.Property(item => item.CareerId).HasColumnName("carrera_id");
        student.Property(item => item.Modality).HasColumnName("modalidad").HasMaxLength(20);
        student.Property(item => item.StatusId).HasColumnName("estatus_id").HasMaxLength(3);
        student.Property(item => item.Generation).HasColumnName("generacion").HasMaxLength(4);
        student.Property(item => item.IsEnrolled).HasColumnName("inscrito");
        student.Property(item => item.ShiftId).HasColumnName("turno_id");
        student.Property(item => item.EntryPeriodId).HasColumnName("periodo_ingreso");
        student.Property(item => item.Email).HasColumnName("correo").HasMaxLength(50);
        student.Property(item => item.Section).HasColumnName("seccion").HasMaxLength(2);

        var teacher = modelBuilder.Entity<Teacher>();
        teacher.ToTable("docentes");
        teacher.HasKey(item => item.Key).HasName("pk_docentes");
        teacher.Property(item => item.Key).HasColumnName("clave").HasMaxLength(5);
        teacher.Property(item => item.FirstName).HasColumnName("nombre").HasMaxLength(60);
        teacher.Property(item => item.LastNames).HasColumnName("apellidos").HasMaxLength(60);
        teacher.Property(item => item.Sex).HasColumnName("sexo").HasMaxLength(1);
        teacher.Property(item => item.Email).HasColumnName("correo").HasMaxLength(100);
        teacher.Property(item => item.Type).HasColumnName("tipo").HasMaxLength(20);
        teacher.Property(item => item.DepartmentId).HasColumnName("cve_depto");
        teacher.Property(item => item.TotalHours).HasColumnName("total_horas");
        teacher.Property(item => item.IsActive).HasColumnName("vigente");
    }
}
