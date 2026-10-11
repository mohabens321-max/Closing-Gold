# لأي استضافة Docker: خادم VPS أو Render أو Fly.io أو Railway ... ويعمل محلياً أيضاً
FROM python:3.12-slim
ENV PYTHONUNBUFFERED=1 PORT=8080 DATA_DIR=/data
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
RUN useradd -m app && mkdir -p /data && chown -R app /data /app
USER app
EXPOSE 8080
CMD ["sh", "-c", "gunicorn -b 0.0.0.0:${PORT} -w 2 --threads 4 --timeout 60 app:app"]
