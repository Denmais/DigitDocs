#!/usr/bin/python3.12
# -*- coding: utf-8 -*-
# encoding=utf8
import sys
sys.path.insert(0, '/home/invoice/bck')


print("WSGI sys.executable:", sys.executable)
print("WSGI sys.version:", sys.version)
print("WSGI sys.path:", sys.path)


from main import app as application
