import urllib.request, json, os

# Read .env
env = {}
env_path = os.path.join(os.path.dirname(__file__), '..', '..', '.env')
with open(env_path) as f:
    for line in f:
        line = line.strip()
        if '=' in line and not line.startswith('#'):
            k, v = line.split('=', 1)
            env[k.strip()] = v.strip().strip('"')

url = 'https://iutcgogmxhaqgaxkznxu.supabase.co'
key = env.get('SUPABASE_SERVICE_ROLE_KEY') or env.get('SUPABASE_SERVICE_KEY')

req = urllib.request.Request(
    f'{url}/rest/v1/questions?select=topic,subject,year_group,question_type&limit=10',
    headers={'apikey': key, 'Authorization': f'Bearer {key}'}
)
res = urllib.request.urlopen(req)
rows = json.loads(res.read())
for r in rows:
    print(r)