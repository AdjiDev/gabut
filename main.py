import random
from flask import Flask, request, send_file, abort
from faker import Faker
from pyngrok import ngrok

app = Flask(__name__)
fake = Faker()

def random_ip():
    return ".".join(str(random.randint(1, 255)) for _ in range(4))

def random_port():
    return str(random.randint(1024, 65535))

def generate_proxies(proxy_type, amount):
    proxies = []
    for _ in range(amount):
        ip = random_ip()
        port = random_port()
        proxies.append(f"{proxy_type}://{ip}:{port}")
    return proxies

def generate_user_agents(amount):
    user_agents = []
    for _ in range(amount):
        user_agents.append(fake.user_agent())
    return user_agents

@app.route('/create/proxy', methods=['GET'])
def create_proxy():
    proxy_type = request.args.get('type')
    amount = request.args.get('amount', type=int)

    if proxy_type not in ['http', 'socks']:
        abort(400, "Invalid proxy type. Use 'http' or 'socks'.")
    if not (1 <= amount <= 99999):
        abort(400, "Invalid amount. Use a number between 1 and 99999.")

    proxies = generate_proxies(proxy_type, amount)
    user_agents = generate_user_agents(amount)

    # Create a temporary file to store the proxies and user agents
    temp_file_path = "proxies_and_ua.txt"
    with open(temp_file_path, "w") as file:
        for proxy, ua in zip(proxies, user_agents):
            file.write(f"{proxy} - {ua}\n")

    # Send the file to the client
    return send_file(temp_file_path, as_attachment=True)

@app.route('/create/ua', methods=['GET'])
def create_user_agents():
    amount = request.args.get('amount', type=int)

    if not (1 <= amount <= 99999):
        abort(400, "Invalid amount. Use a number between 1 and 99999.")

    user_agents = generate_user_agents(amount)

    # Create a temporary file to store the user agents
    temp_file_path = "user_agents.txt"
    with open(temp_file_path, "w") as file:
        for ua in user_agents:
            file.write(f"{ua}\n")

    # Send the file to the client
    return send_file(temp_file_path, as_attachment=True)

if __name__ == '__main__':
    # Set up ngrok authentication token
    ngrok.set_auth_token("2jot90lZuoFLamhBpVadV876qkO_28HmUx5p3ynJT1DutrtXg")

    # Open an ngrok tunnel to the Flask app
    public_url = ngrok.connect(5000)
    print(f"ngrok tunnel created at: {public_url}")

    # Run the Flask application
    app.run(port=5000)
