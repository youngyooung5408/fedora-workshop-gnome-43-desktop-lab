#!/usr/bin/env python3
import argparse
import hashlib
import json
import pathlib
import re
import sys


ROOT = pathlib.Path(__file__).resolve().parent.parent
REGISTRY = ROOT / "host-features.json"
VERSION_RE = re.compile(r"v(\d+)\.(\d+)\.(\d+)")


def version_key(value):
    match = VERSION_RE.fullmatch(value)
    if not match:
        raise SystemExit(f"Invalid version: {value}")
    return tuple(map(int, match.groups()))


def version_dir(version):
    major, minor, _ = version_key(version)
    return ROOT / "versions" / f"v{major}" / f"v{major}.{minor}" / version


def tree_hash(path):
    path = pathlib.Path(path)
    digest = hashlib.sha256()
    if not path.is_dir():
        raise SystemExit(f"Missing feature payload directory: {path}")
    for item in sorted(
        candidate for candidate in path.rglob("*")
        if candidate.is_file()
        and "__pycache__" not in candidate.parts
        and candidate.suffix != ".pyc"
    ):
        relative = item.relative_to(path).as_posix().encode()
        digest.update(len(relative).to_bytes(8, "big"))
        digest.update(relative)
        data = item.read_bytes()
        digest.update(len(data).to_bytes(8, "big"))
        digest.update(data)
    return digest.hexdigest()


def load_registry():
    data = json.loads(REGISTRY.read_text(encoding="utf-8"))
    if set(data) != {"schema_version", "features", "releases"} or data["schema_version"] != 1:
        raise SystemExit("host-features.json has an unsupported shape or schema version")
    if not data["features"] or not data["releases"]:
        raise SystemExit("host-features.json must define features and releases")
    return data


def resolve(data, version, profile=None):
    release = data["releases"].get(version)
    if release is None:
        raise SystemExit(f"Release is not registered for host installation: {version}")
    profile = pathlib.Path(profile) if profile else version_dir(version) / "profile"
    resolved = []
    for feature_id, revision_id in release["features"].items():
        feature = data["features"].get(feature_id)
        if feature is None:
            raise SystemExit(f"Unknown feature {feature_id} in {version}")
        revision = feature.get("revisions", {}).get(revision_id)
        if revision is None:
            raise SystemExit(f"Unknown revision {feature_id}:{revision_id} in {version}")
        kind = feature.get("kind")
        if kind == "extension":
            uuid = feature["uuid"]
            payload = profile / "extensions" / uuid
            actual_hash = tree_hash(payload)
            expected_hash = revision["sha256"]
            if actual_hash != expected_hash:
                raise SystemExit(
                    f"Payload hash mismatch for {feature_id}:{revision_id} in {version}: "
                    f"expected {expected_hash}, got {actual_hash}"
                )
            resolved.append({
                "id": feature_id,
                "kind": kind,
                "revision": revision_id,
                "uuid": uuid,
                "payload": str(payload),
                "sha256": actual_hash,
            })
        elif kind == "gsettings":
            resolved.append({
                "id": feature_id,
                "kind": kind,
                "revision": revision_id,
                "schema": feature["schema"],
                "key": feature["key"],
                "value": revision["value"],
            })
        else:
            raise SystemExit(f"Unsupported feature kind for {feature_id}: {kind}")
    return resolved


def validate(data):
    previous = None
    for version in sorted(data["releases"], key=version_key):
        if previous is not None and version_key(version) <= version_key(previous):
            raise SystemExit("Release versions are not strictly ordered")
        resolve(data, version)
        previous = version


def main():
    parser = argparse.ArgumentParser()
    subparsers = parser.add_subparsers(dest="command", required=True)
    subparsers.add_parser("validate")
    latest_parser = subparsers.add_parser("latest")
    latest_parser.add_argument("--major-minor")
    resolve_parser = subparsers.add_parser("resolve")
    resolve_parser.add_argument("version")
    resolve_parser.add_argument("--profile")
    manifest_parser = subparsers.add_parser("manifest")
    manifest_parser.add_argument("version")
    manifest_parser.add_argument("profile")
    manifest_parser.add_argument("destination")
    hash_parser = subparsers.add_parser("tree-hash")
    hash_parser.add_argument("path")
    identify_parser = subparsers.add_parser("identify")
    identify_parser.add_argument("feature")
    identify_parser.add_argument("sha256")
    args = parser.parse_args()

    if args.command == "tree-hash":
        print(tree_hash(args.path))
        return

    data = load_registry()
    if args.command == "validate":
        validate(data)
        print("Host feature registry is valid.")
    elif args.command == "latest":
        versions = list(data["releases"])
        if args.major_minor:
            prefix = args.major_minor + "."
            versions = [version for version in versions if version.startswith(prefix)]
        if not versions:
            raise SystemExit("No matching registered host release")
        print(max(versions, key=version_key))
    elif args.command == "resolve":
        print(json.dumps({"version": args.version, "features": resolve(data, args.version, args.profile)}))
    elif args.command == "identify":
        feature = data["features"].get(args.feature)
        if feature is None or feature.get("kind") != "extension":
            raise SystemExit(f"Unknown extension feature: {args.feature}")
        matches = [
            revision_id
            for revision_id, revision in feature["revisions"].items()
            if revision.get("sha256") == args.sha256
        ]
        if not matches:
            raise SystemExit(1)
        print(",".join(matches))
    elif args.command == "manifest":
        features = resolve(data, args.version, args.profile)
        for feature in features:
            if feature["kind"] == "extension":
                feature["payload"] = f"profile/extensions/{feature['uuid']}"
        destination = pathlib.Path(args.destination)
        manifest = {"format": 2, "version": args.version, "features": features}
        destination.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
