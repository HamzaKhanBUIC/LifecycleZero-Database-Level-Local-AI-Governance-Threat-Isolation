@echo off
echo ===================================================
echo ⚡ LifecycleZero Local Test Suite Bootstrapper ⚡
echo ===================================================
echo.

:: Verify Docker is running
docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Error: Docker Daemon is not running!
    echo Please start Docker Desktop and run this script again.
    echo.
    pause
    exit /b 1
)

:: Manage local DynamoDB container in detached mode
echo 📦 Inspecting local DynamoDB container...
FOR /F "tokens=*" %%i IN ('docker ps -a -q --filter "ancestor=amazon/dynamodb-local"') DO (
    echo 🧹 Cleaning up existing DynamoDB container: %%i
    docker rm -f %%i >nul 2>&1
)

echo 📥 Launching new detached DynamoDB Local container on port 8000...
docker run -d -p 8000:8000 --name lifecycle-dynamo amazon/dynamodb-local

echo ⏳ Waiting for DynamoDB Local port 8000 to listen (5s)...
ping -n 6 127.0.0.1 >nul

:: Provision local database schema
echo 🚀 Provisioning base table and secondary indexes...
call npm run db:provision-local
if %errorlevel% neq 0 (
    echo ❌ Error: Provisioning failed!
    pause
    exit /b 1
)

:: Seed mock dataset
echo 🌱 Seeding mock dataset (Tenant: org_demo_123)...
call npm run db:seed-local
if %errorlevel% neq 0 (
    echo ❌ Error: Seeding failed!
    pause
    exit /b 1
)

:: Run all 5 Access Pattern Integration tests
echo 🧪 Running access pattern integration tests...
call npm run test:integration
if %errorlevel% neq 0 (
    echo ❌ Error: Integration verification failed!
    pause
    exit /b 1
)

:: Start the local Next.js environment
echo.
echo ===================================================
echo ✅ Setup complete! Starting Next.js Dev Server...
echo ℹ️  Open http://localhost:3000 in your browser.
echo ===================================================
echo.
call npm run dev
