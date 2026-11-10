#!/usr/bin/env python3
"""Prune old images from the Vercel Container Registry (VCR).

Every production build of a container service pushes a new image tag.
VCR allows a limited number of images per repository (currently 50), after
which builds fail with:

    Error: [BUILD_FAILED] Pushing ... was denied.
    repository has reached the maximum allowed number of images

This script keeps the newest N images in one repository and deletes the
rest. The newest image is usually the one serving production, so keep at
least 2 while a deploy is in flight.

Usage:
    set VERCEL_TOKEN=...            # or export on *nix
    python scripts/vcr-prune.py --project closing --repo api --keep 5
    python scripts/vcr-prune.py --project closing --repo api --keep 5 --dry-run

The token needs access to the team that owns the project. The team is
auto-detected when the token belongs to exactly one team; otherwise pass
--team <slug>.
"""
import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

API = 'https://api.vercel.com'


def get(token, path, **params):
    url = API + path
    if params:
        url += '?' + urllib.parse.urlencode({k: v for k, v in params.items() if v is not None})
    req = urllib.request.Request(url, headers={'Authorization': 'Bearer ' + token})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read())


def delete(token, path, **params):
    url = API + path
    if params:
        url += '?' + urllib.parse.urlencode({k: v for k, v in params.items() if v is not None})
    req = urllib.request.Request(url, method='DELETE', headers={'Authorization': 'Bearer ' + token})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.status


def resolve_team(token, slug):
    teams = get(token, '/v2/teams', limit=50).get('teams', [])
    if slug:
        for t in teams:
            if t.get('slug') == slug:
                return t['id']
        sys.exit('team not found: %s' % slug)
    if len(teams) == 1:
        return teams[0]['id']
    if not teams:
        return None  # personal account
    sys.exit('token sees several teams; pass --team <slug>: %s' % ', '.join(t['slug'] for t in teams))


def resolve_project(token, team_id, name):
    projects = get(token, '/v9/projects', teamId=team_id, limit=100).get('projects', [])
    for p in projects:
        if p.get('name') == name:
            return p['id']
    sys.exit('project not found: %s' % name)


def resolve_repo(token, team_id, project_id, name):
    repos = get(token, '/v1/vcr/repository', teamId=team_id, projectId=project_id).get('repositories', [])
    for r in repos:
        if r.get('name') == name:
            return r['id']
    sys.exit('repository not found: %s' % name)


def list_images(token, team_id, project_id, repo_id):
    images = []
    offset = 0
    while True:
        d = get(token, '/v1/vcr/repository/%s/images' % repo_id,
                teamId=team_id, projectId=project_id, limit=100, offset=offset)
        images.extend(d.get('images', []))
        nxt = (d.get('pagination') or {}).get('next')
        if not nxt:
            break
        offset = nxt
    # newest first
    images.sort(key=lambda x: x.get('createdAt', ''), reverse=True)
    return images


def main():
    ap = argparse.ArgumentParser(description='Keep the newest N VCR images and delete the rest.')
    ap.add_argument('--project', required=True, help='Vercel project name')
    ap.add_argument('--repo', required=True, help='container repository name inside the project')
    ap.add_argument('--keep', type=int, default=5, help='how many newest images to keep (default 5)')
    ap.add_argument('--team', help='team slug (auto-detected when the token has one team)')
    ap.add_argument('--dry-run', action='store_true', help='print what would be deleted')
    args = ap.parse_args()

    token = os.environ.get('VERCEL_TOKEN', '').strip()
    if not token:
        sys.exit('VERCEL_TOKEN is not set')

    team_id = resolve_team(token, args.team)
    project_id = resolve_project(token, team_id, args.project)
    repo_id = resolve_repo(token, team_id, project_id, args.repo)
    images = list_images(token, team_id, project_id, repo_id)

    print('repository %s/%s: %d images' % (args.project, args.repo, len(images)))
    if len(images) <= args.keep:
        print('nothing to prune (keep=%d)' % args.keep)
        return

    doomed = images[args.keep:]
    print('keeping %d, deleting %d' % (args.keep, len(doomed)))
    for img in images[:args.keep]:
        print('  keep   %s  %s  %s' % (img['id'], img.get('createdAt', '')[:19], ','.join(img.get('tags') or [])))

    failed = 0
    for i, img in enumerate(doomed, 1):
        tags = ','.join(img.get('tags') or []) or '(untagged)'
        if args.dry_run:
            print('  would delete %s  %s  %s' % (img['id'], img.get('createdAt', '')[:19], tags))
            continue
        try:
            status = delete(token, '/v1/vcr/repository/%s/images/%s' % (repo_id, img['id']),
                            teamId=team_id, projectId=project_id)
            print('  deleted %s  %s  %s  [%s]' % (img['id'], img.get('createdAt', '')[:19], tags, status))
        except urllib.error.HTTPError as e:
            failed += 1
            print('  FAILED  %s  %s  HTTP %s %s' % (img['id'], tags, e.code, e.read()[:120]))
        time.sleep(0.15)

    if failed:
        sys.exit('%d image(s) could not be deleted' % failed)


if __name__ == '__main__':
    main()
