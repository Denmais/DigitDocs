from flask import Flask, request, jsonify, url_for, send_from_directory, abort, g, send_file
from database import SessionLocal, engine
from pydantic import ValidationError
import os
from schemas import UploadFile, UploadResponse
from view import upload_file, types, process, extract, collect, history, excel
import models
import os

app = Flask(__name__, static_folder=None)

BASE_DIR = os.path.dirname(__file__)
FRONTEND_DIR = os.path.join(BASE_DIR, "frontend")
XLS = os.path.join(BASE_DIR, "xls")

def get_db():
    if "db" not in g:
        g.db = SessionLocal()
    return g.db


@app.teardown_appcontext
def shutdown_session(exception=None):
    db = g.pop("db", None)
    if db is not None:
        db.close()



@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def serve_frontend(path):
    # не перехватываем API и служебные роуты
    if path.startswith(("api/", "download/", "uploads/")):
        abort(404)

    file_path = os.path.join(FRONTEND_DIR, path)
    if path and os.path.isfile(file_path):
        return send_from_directory(FRONTEND_DIR, path)

    return send_from_directory(FRONTEND_DIR, "index.html")


#BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOAD_FOLDER = os.path.join(BASE_DIR, "uploads")
#UPLOAD_FOLDER = 'uploads'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER


@app.route('/uploads/<path:filename>')
def uploads_file(filename):
    return send_from_directory('uploads', filename)


@app.route('/api/upload', methods=['POST'])
def upload():
    db = get_db()
    try:
        validate_data = upload_file(db, files=request.files, form=request.form)

        if validate_data is None:
            return jsonify({"error": "No file / empty filename"}), 400

        return jsonify(validate_data.model_dump()), 201

    except Exception as e:
        print(e)
        return jsonify({"error": str(e)}), 500


@app.route('/download/<path:filename>', methods=['GET'])
def download_file(filename):
    try:
        return send_from_directory(
            app.config['UPLOAD_FOLDER'],
            filename,
            as_attachment=True
        )
    except Exception as e:
        print(e)
        abort(404)


@app.route('/api/document-types', methods=['GET'])
def get_types():
    db = get_db()
    try:
        validate_data = types(db)
        return jsonify(validate_data), 200
    except Exception as e:
        print(e)
        abort(404)


@app.route('/api/process/status', methods=['GET'])
def get_fields():
    db = get_db()
    try:
        validate_data = process(db, args=request.args)
        if validate_data is None:
            raise Exception
        return validate_data, 200
    except Exception as e:
        print(e)
        abort(400)


@app.route('/api/extract-field', methods=['POST'])
def extract_data():
    db = get_db()
    try:
        payload = request.get_json(silent=True)

        if not payload:
            return jsonify({"error": "Invalid or empty JSON body"}), 400

        val = extract(payload, db)

        # extract() возвращает dict через model_dump()
        return jsonify(val), 200

    except Exception as e:
        app.logger.exception("extract-field failed")
        return jsonify({"error": str(e)}), 400



@app.route('/api/collect', methods=['POST'])
def collect_data():
    db = get_db()
    try:
        val = collect(db, request.get_json())
        return val
    except Exception as e:
        print(e)
        abort(400)

@app.route('/api/history', methods=['GET'])
def collect_history():
    db = get_db()
    try:
        val = history(db)
        return val
    except Exception as e:
        print(e)
        abort(400)

@app.route('/api/excel', methods=['GET'])
def collect_xls():
    db = get_db()
    try:
        val = excel(db, args=request.args)
        return send_file(
        f"{XLS}/{val}.xlsx",
        as_attachment=True,
        download_name=f"{val}.xlsx")
        #return val
    except Exception as e:
        print(e)
        abort(400)


if __name__ == '__main__':
    models.Base.metadata.create_all(bind=engine)
    app.run(debug=True)
