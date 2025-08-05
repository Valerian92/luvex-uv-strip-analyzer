from fastapi import FastAPI

app = FastAPI(title="UV Strip Analyzer API")

@app.get("/")
def read_root():
    return {"message": "UV Strip Analyzer läuft!"}

@app.get("/health")
def health_check():
    return {"status": "healthy", "version": "1.0.0"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
