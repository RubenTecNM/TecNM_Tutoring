namespace TecNM.Api.Core.Entities;

/// <summary>Alumno de la BD Principal (solo lectura). Tabla: alumnos.</summary>
public sealed class Student
{
    public required string EnrollmentNumber { get; init; }
    public required string LastNames { get; init; }
    public required string FirstName { get; init; }
    public required string Sex { get; init; }
    public int Semester { get; init; }
    public int CareerId { get; init; }
    public required string Modality { get; init; }
    public required string StatusId { get; init; }
    public required string Generation { get; init; }
    public bool IsEnrolled { get; init; }
    public int? ShiftId { get; init; }
    public int EntryPeriodId { get; init; }
    public string? Email { get; init; }
    public string? Section { get; init; }
}
