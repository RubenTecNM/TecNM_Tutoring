# Etapa 1: Compilación con SDK .NET 10
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

COPY ["TecNM.Api.csproj", "./"]
RUN dotnet restore "TecNM.Api.csproj"

COPY . .
RUN dotnet publish "TecNM.Api.csproj" -c Release -o /app/publish /p:UseAppHost=false

# Etapa 2: Runtime optimizado .NET 10
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app

RUN mkdir -p /app/uploads/documents /app/uploads/templates
COPY --from=build /app/publish .

EXPOSE 5185
ENTRYPOINT ["dotnet", "TecNM.Api.dll"]