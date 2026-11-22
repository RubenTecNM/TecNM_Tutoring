using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace TecNM.Api.Modules.Health;

[ApiController]
[Route("api/[controller]")]
public sealed class HealthController(HealthService healthService) : ControllerBase
{
    [AllowAnonymous]
    [HttpGet]
    [HttpGet("/health")]
    public ActionResult<HealthResponse> Get()
    {
        return Ok(healthService.GetHealth());
    }
}
