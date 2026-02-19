"""
Git utilities — clone, branch, commit, push.
GitHub token is embedded in the remote URL so pushes work on Railway.
"""
import os
import stat
import shutil
import tempfile
import git
from dotenv import load_dotenv

load_dotenv()

GITHUB_TOKEN = os.getenv("GITHUB_TOKEN", "")


def make_branch_name(team_name: str, leader_name: str) -> str:
    """
    Build the required branch name in the format:
        TEAM_NAME_LEADER_NAME_AI_Fix
    E.g. "RIFT ORGANISERS" + "Saiyam Kumar" → "RIFT_ORGANISERS_SAIYAM_KUMAR_AI_Fix"
    """
    team = team_name.strip().upper().replace(" ", "_")
    leader = leader_name.strip().upper().replace(" ", "_")
    return f"{team}_{leader}_AI_Fix"


def _auth_url(repo_url: str) -> str:
    """Embed the GitHub token into a https URL for authenticated push."""
    if GITHUB_TOKEN and repo_url.startswith("https://"):
        return repo_url.replace("https://", f"https://{GITHUB_TOKEN}@")
    return repo_url


def _force_remove(path: str) -> None:
    """
    Remove a directory tree even if it contains read-only files (.git objects on Windows).
    Uses an error handler to chmod files before retry — needed on Windows where .git
    objects are often marked read-only, and on OneDrive paths where files may be locked.
    """
    def _on_error(func, path, exc_info):
        try:
            os.chmod(path, stat.S_IWRITE)
            func(path)
        except Exception:
            pass  # best effort

    if os.path.exists(path):
        shutil.rmtree(path, onerror=_on_error)


def clone_repo(repo_url: str, local_path: str) -> git.Repo:
    """Clone a GitHub repo to local_path and return the Repo object.

    Always removes the target directory first so stale / locked leftover
    dirs from previous runs never cause 'Permission denied' on Windows/OneDrive.

    NOTE: Clones WITHOUT the GitHub token so fine-grained PATs don't cause
    403 errors on repos they weren't scoped to. The token is only injected
    at push time (in push_branch) where write access is actually needed.
    """
    # Clean up any previous attempt at this path before cloning
    _force_remove(local_path)
    os.makedirs(local_path, exist_ok=True)

    repo = git.Repo.clone_from(repo_url, local_path)
    return repo


def create_and_checkout_branch(repo: git.Repo, branch_name: str) -> None:
    """Create a new branch from HEAD and check it out."""
    new_branch = repo.create_head(branch_name)
    new_branch.checkout()


def commit_file(repo: git.Repo, file_path: str, commit_msg: str) -> None:
    """Stage a single file and commit with the given message."""
    repo.index.add([file_path])
    repo.index.commit(commit_msg)


def push_branch(repo: git.Repo, repo_url: str, branch_name: str) -> None:
    """
    Push branch to origin (force push so re-runs overwrite the old branch).
    The remote URL is updated with the GitHub token before pushing
    so this works both locally and on Railway.
    """
    auth_url = _auth_url(repo_url)
    origin = repo.remotes.origin
    origin.set_url(auth_url)
    # Use + prefix on refspec = force push; handles re-runs where branch already exists
    origin.push(refspec=f"+{branch_name}:{branch_name}", force=True)

