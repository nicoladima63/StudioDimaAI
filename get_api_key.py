import requests

url = "https://api.anthropic.com/v1/organizations/api_keys/{api_key_id}"

headers = {
    "x-api-key": "<x-api-key>",
    "anthropic-version": "<anthropic-version>"
}

response = requests.request("GET", url, headers=headers)

print(response.text)