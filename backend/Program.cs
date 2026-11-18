using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using TecNM.Api.Core.Entities;
using TecNM.Api.Data;
using TecNM.Api.Modules.Auth;
using TecNM.Api.Modules.Health;

const string FrontendCors = "Frontend";

LoadDotEnv();

var builder = WebApplication.CreateBuilder(args);
var configuration = builder.Configuration;

var connectionString = configuration.GetConnectionString("DefaultConnection");
if (string.IsNullOrWhiteSpace(connectionString))
{
    throw new InvalidOperationException(
        "Falta ConnectionStrings__DefaultConnection en la configuración.");
}

var mainConnectionString = configuration.GetConnectionString("MainConnection");
if (string.IsNullOrWhiteSpace(mainConnectionString))
{
    throw new InvalidOperationException(
        "Falta ConnectionStrings__MainConnection en la configuración.");
}

var secret = configuration["Jwt:SecretKey"];
if (string.IsNullOrWhiteSpace(secret) || Encoding.UTF8.GetByteCount(secret) < 32)
{
    throw new InvalidOperationException(
        "Jwt__SecretKey es obligatorio y debe contener al menos 32 bytes UTF-8.");
}

var issuer = configuration["Jwt:Issuer"];
var audience = configuration["Jwt:Audience"];
var lifetimeHours = configuration.GetValue<int?>("Jwt:LifetimeHours");
if (string.IsNullOrWhiteSpace(issuer) || string.IsNullOrWhiteSpace(audience) || lifetimeHours != 8)
{
    throw new InvalidOperationException(
        "Jwt:Issuer, Jwt:Audience y Jwt:LifetimeHours=8 son obligatorios.");
}

var allowedOrigin = configuration["Cors:AllowedOrigin"]?.TrimEnd('/');
if (string.IsNullOrWhiteSpace(allowedOrigin)
    || !Uri.TryCreate(allowedOrigin, UriKind.Absolute, out var originUri)
    || originUri.Scheme != Uri.UriSchemeHttps)
{
    throw new InvalidOperationException(
        "Cors__AllowedOrigin debe ser un origen HTTPS absoluto.");
}

var signingKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secret));
var jwtSettings = new JwtSettings(issuer, audience, lifetimeHours.Value, signingKey);

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddDbContext<TecNMDbContext>(options => options.UseNpgsql(connectionString));
builder.Services.AddDbContext<MainDbContext>(options => options.UseNpgsql(mainConnectionString));
builder.Services.AddScoped<AuthService>();
builder.Services.AddScoped<HealthService>();
builder.Services.AddScoped<PasswordHasher<User>>();
builder.Services.AddSingleton(jwtSettings);
builder.Services.AddCors(options => options.AddPolicy(FrontendCors, policy =>
    policy.WithOrigins(allowedOrigin).AllowAnyHeader().AllowAnyMethod().AllowCredentials()));
builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.MapInboundClaims = false;
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = issuer,
            ValidateAudience = true,
            ValidAudience = audience,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = signingKey,
            ValidateLifetime = true,
            RequireExpirationTime = true,
            RequireSignedTokens = true,
            ValidAlgorithms = [SecurityAlgorithms.HmacSha256],
            NameClaimType = "name",
            RoleClaimType = "role",
            ClockSkew = TimeSpan.Zero
        };
        options.Events = new JwtBearerEvents
        {
            OnMessageReceived = context =>
            {
                var token = context.Request.Cookies["auth_token"];
                if (string.IsNullOrEmpty(token))
                {
                    context.NoResult();
                }
                else
                {
                    context.Token = token;
                }

                return Task.CompletedTask;
            }
        };
    });
builder.Services.AddAuthorization();

var app = builder.Build();

app.UseSwagger();
app.UseSwaggerUI(c =>
{
    c.SwaggerEndpoint("/swagger/v1/swagger.json", "TecNM Tutoring API v1");
    c.RoutePrefix = "swagger";
});

app.UseHttpsRedirection();
app.UseCors(FrontendCors);
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

app.Run();

static void LoadDotEnv()
{
    var searchDir = new DirectoryInfo(Directory.GetCurrentDirectory());
    DirectoryInfo? backendDir = null;

    if (File.Exists(Path.Combine(searchDir.FullName, "TecNM.Api.csproj")))
    {
        backendDir = searchDir;
    }
    else if (Directory.Exists(Path.Combine(searchDir.FullName, "backend")))
    {
        backendDir = new DirectoryInfo(Path.Combine(searchDir.FullName, "backend"));
    }
    else
    {
        var baseDir = new DirectoryInfo(AppContext.BaseDirectory);
        while (baseDir != null)
        {
            if (File.Exists(Path.Combine(baseDir.FullName, "TecNM.Api.csproj")))
            {
                backendDir = baseDir;
                break;
            }

            baseDir = baseDir.Parent;
        }
    }

    if (backendDir == null)
    {
        return;
    }

    var envPath = Path.Combine(backendDir.FullName, ".env");
    if (!File.Exists(envPath))
    {
        return;
    }

    foreach (var rawLine in File.ReadAllLines(envPath))
    {
        var line = rawLine.Trim();
        if (string.IsNullOrWhiteSpace(line) || line.StartsWith('#'))
        {
            continue;
        }

        var separatorIndex = line.IndexOf('=');
        if (separatorIndex <= 0)
        {
            continue;
        }

        var key = line[..separatorIndex].Trim();
        var value = line[(separatorIndex + 1)..].Trim().Trim('"', '\'');

        if (string.IsNullOrEmpty(Environment.GetEnvironmentVariable(key)))
        {
            Environment.SetEnvironmentVariable(key, value);
        }
    }
}
