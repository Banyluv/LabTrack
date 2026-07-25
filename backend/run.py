"""run.py — Start the LabTrack backend API server.

Usage:
    python run.py              # start on default port 5000
    python run.py --port 8080  # custom port
"""

import argparse
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.abspath(__file__))


def start_uvicorn(port: int) -> None:
    print(f"Starting API server on http://0.0.0.0:{port} …")
    uvicorn_args = [
        sys.executable, "-m", "uvicorn", "app.main:app",
        "--host", "0.0.0.0",
        "--port", str(port),
    ]
    subprocess.run(uvicorn_args, cwd=ROOT)


def main() -> None:
    parser = argparse.ArgumentParser(description="LabTrack Backend Launcher")
    parser.add_argument("--port", type=int, default=5000,
                        help="Port to listen on (default: 5000)")
    args = parser.parse_args()

    try:
        start_uvicorn(args.port)
    except KeyboardInterrupt:
        print("\nServer stopped.")
    except Exception as exc:
        print(f"\nError: {exc}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()