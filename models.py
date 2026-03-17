from sqlalchemy import Boolean, Column, ForeignKey, Integer, String, DateTime
from sqlalchemy.orm import relationship
from database import Base            #database.py
import datetime


class UploadedFile(Base):
    __tablename__ = "uploadfiles"

    id = Column(Integer, primary_key=True)
    upload_id = Column(String(120), nullable=False)
    filename = Column(String(120), nullable=False)
    filepath = Column(String(255), nullable=False)
    comment = Column(String(255), nullable=True)
    type_id = Column(Integer, ForeignKey("doctype.id"))
    type = relationship("DocumentType", back_populates="files")
    uploaded_at = Column(DateTime)

    def __repr__(self):
        return f"{self.filename}"


class DocumentType(Base):
    __tablename__ = "doctype"

    id = Column(Integer, primary_key=True)
    title = Column(String(120), nullable=False)
    files = relationship("UploadedFile", back_populates="type")

    def __repr__(self):
        return f"{self.title}"


class ExtractData(Base):
    __tablename__ = "extractdata"

    id = Column(Integer, primary_key=True)
    upload_id = Column(String(120), nullable=False)
    doc_name = Column(String(120), nullable=False)
    title = Column(String(120), nullable=False)
    ru_title = Column(String(120), nullable=False)
    type = Column(String(120), nullable=False)
    unit = Column(String(120), nullable=False)
    value = Column(String(120), nullable=False)
    timestamp = Column(DateTime, nullable=False, default=datetime.datetime.now())
    def __repr__(self):
        return f"{self.id}"
