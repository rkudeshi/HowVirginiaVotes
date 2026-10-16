"""Bounded retries for transient source failures, without bypassing validation."""
import time
import urllib.error
import urllib.request
import http.client

def fetch_bytes(url, timeout=60):
    for attempt in range(3):
        try:
            request = urllib.request.Request(url, headers={'Cache-Control': 'no-cache'})
            with urllib.request.urlopen(request, timeout=timeout) as response:
                return response.read()
        except urllib.error.HTTPError as error:
            if error.code not in (408, 429, 500, 502, 503, 504) or attempt == 2:
                raise
        except (urllib.error.URLError, TimeoutError, ConnectionError, http.client.IncompleteRead):
            if attempt == 2:
                raise
        time.sleep(2 ** attempt)
