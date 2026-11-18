namespace TecNM.Api.Core.Entities;

/// <summary>Docente/tutor de la BD Principal (solo lectura). Tabla: docentes.</summary>
public sealed class Teacher
{
    public required string Key { get; init; }
    public required string FirstName { get; init; }
    public required string LastNames { get; init; }
    public required string Sex { get; init; }
    public required string Email { get; init; }
    public string? Type { get; init; }
    public int? DepartmentId { get; init; }
    public int? TotalHours { get; init; }
    public bool IsActive { get; init; }
}
