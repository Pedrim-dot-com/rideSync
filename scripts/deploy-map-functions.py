"""Deploy approved map functions through the Supabase Management API.

Uses injected SUPABASE_ACCESS_TOKEN directly over HTTPS. Never prints or stores
credentials. Run only after the project owner authorizes the deployment.
"""
import argparse
import json
import os
from pathlib import Path
import re
import subprocess

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--project-ref', required=True)
parser.add_argument('--dry-run', action='store_true')
options = parser.parse_args()
if not re.fullmatch('[a-z]{20}', options.project_ref):
    parser.error('Expected a 20-letter Supabase project ref')
root = Path(__file__).resolve().parents[1] / 'supabase' / 'functions'
shared = [root / '_shared' / name for name in
          ['contracts.ts', 'handler.ts', 'providers.ts', 'runtime.ts']]
for slug in ['search-places', 'calculate-route']:
    metadata = {'name': slug, 'entrypoint_path': slug + '/index.ts',
                'import_map_path': 'deno.json', 'verify_jwt': False}
    files = [root / slug / 'index.ts', root / 'deno.json', root / 'deno.lock', *shared]
    for file in files:
        if not file.is_file():
            raise SystemExit('Missing source file: ' + str(file))
    if options.dry_run:
        print(json.dumps({'slug': slug, 'metadata': metadata,
                          'files': [p.relative_to(root).as_posix() for p in files]}))
        continue
    token = os.environ.get('SUPABASE_ACCESS_TOKEN')
    if not token:
        raise SystemExit('SUPABASE_ACCESS_TOKEN is required')
    args = ['curl', '--silent', '--show-error', '--max-time', '120', '-X', 'POST',
            '-H', 'Authorization: Bearer ' + token,
            '-F', 'metadata=' + json.dumps(metadata) + ';type=application/json']
    for file in files:
        args += ['-F', 'file=@' + str(file) + ';filename=' + file.relative_to(root).as_posix()]
    args += ['-w', '\n%{http_code}', 'https://api.supabase.com/v1/projects/'
             + options.project_ref + '/functions/deploy?slug=' + slug]
    result = subprocess.run(args, capture_output=True, text=True)
    body, _, status = result.stdout.rpartition('\n')
    if result.returncode:
        raise SystemExit('Deployment transport failed: ' + result.stderr[:300])
    try:
        data = json.loads(body)
    except ValueError:
        raise SystemExit('Unexpected deployment response HTTP ' + status)
    if status not in ('200', '201'):
        raise SystemExit('Deploy ' + slug + ' failed HTTP ' + status + ': '
                         + str(data.get('message', 'Unknown API error'))[:1800])
    print(json.dumps({key: data.get(key) for key in
                      ['slug', 'status', 'version', 'verify_jwt', 'import_map']}), flush=True)
