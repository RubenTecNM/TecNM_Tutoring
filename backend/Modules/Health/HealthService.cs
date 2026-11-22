namespace TecNM.Api.Modules.Health;

public sealed class HealthService
{
    public HealthResponse GetHealth() => new("ok", DateTime.UtcNow);
}
