
const fs = require('fs');
const path = require('path');
const dir = 'src/app/pages/catastro';

const tsContent = fs.readFileSync(path.join(dir, 'catastro.page.ts'), 'utf8')
  .replace(/import { Component, OnInit }/, 'import { Component, OnInit, OnDestroy, AfterViewInit }')
  .replace(/implements OnInit {/, 'implements OnInit, AfterViewInit, OnDestroy {');

console.log('Base file read');
