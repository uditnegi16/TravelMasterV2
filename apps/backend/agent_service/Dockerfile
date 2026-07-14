FROM public.ecr.aws/lambda/python:3.12

# Install native libraries required by WeasyPrint
RUN dnf install -y \
    cairo \
    pango \
    gdk-pixbuf2 \
    libffi \
    fontconfig \
    freetype \
    harfbuzz \
    && dnf clean all

COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["lambda_handler.handler"]