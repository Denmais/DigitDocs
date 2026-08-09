import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from database import Base


class DocumentType(Base):
    __tablename__ = "document_types"

    id = Column(Integer, primary_key=True)
    title = Column(String(120), nullable=False, unique=True)
    files = relationship("UploadedFile", back_populates="document_type")
    fields = relationship("DocumentField", back_populates="document_type")

    def __repr__(self):
        return self.title


class UploadedFile(Base):
    __tablename__ = "uploaded_files"

    id = Column(Integer, primary_key=True)
    upload_id = Column(String(120), nullable=False, unique=True, index=True)
    filename = Column(String(255), nullable=False)
    filepath = Column(String(500), nullable=False)
    comment = Column(Text, nullable=True)
    document_type_id = Column(
        Integer,
        ForeignKey("document_types.id"),
        nullable=False,
    )
    uploaded_at = Column(
        DateTime,
        nullable=False,
        default=datetime.datetime.now,
    )

    document_type = relationship("DocumentType", back_populates="files")
    crops = relationship(
        "Crop",
        back_populates="file",
        cascade="all, delete-orphan",
    )

    def __repr__(self):
        return self.filename


class Crop(Base):
    """Выбранная пользователем область документа."""

    __tablename__ = "crops"

    id = Column(Integer, primary_key=True)
    file_id = Column(
        Integer,
        ForeignKey("uploaded_files.id"),
        nullable=False,
    )
    page = Column(Integer, nullable=False, default=1)
    x = Column(Integer, nullable=False)
    y = Column(Integer, nullable=False)
    width = Column(Integer, nullable=False)
    height = Column(Integer, nullable=False)
    created_at = Column(
        DateTime,
        nullable=False,
        default=datetime.datetime.now,
    )

    file = relationship("UploadedFile", back_populates="crops")


class DocumentField(Base):
    """Описание поля, которое можно извлечь из документа."""

    __tablename__ = "document_fields"

    id = Column(Integer, primary_key=True)
    document_type_id = Column(
        Integer,
        ForeignKey("document_types.id"),
        nullable=False,
    )
    title = Column(String(120), nullable=False)
    ru_title = Column(String(120), nullable=True)
    value_type = Column(String(50), nullable=False, default="text")
    unit = Column(String(120), nullable=True)

    document_type = relationship("DocumentType", back_populates="fields")

    def __repr__(self):
        return self.ru_title or self.title