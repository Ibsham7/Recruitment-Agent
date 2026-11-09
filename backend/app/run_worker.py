"""Standalone adaptive worker: python -m app.run_worker."""
from dotenv import load_dotenv


def main():
    load_dotenv()
    from app.adaptive_worker import create_adaptive_worker
    from app.worker import WorkerSettings
    create_adaptive_worker(WorkerSettings).run()


if __name__ == "__main__":
    main()
