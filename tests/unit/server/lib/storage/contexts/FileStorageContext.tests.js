import fs from 'fs';
import path from 'path';
import { expect } from 'chai';
import mock from 'mock-fs';
import FileStorageContext from '../../../../../../server/lib/storage/contexts/FileStorageContext';

describe('FileStorageContext', () => {
  afterEach(() => {
    // Restore filesystem after each test
    mock.restore();
  });

  it('should throw error if path is not provided', () => {
    try {
      new FileStorageContext();
      expect.fail('Should have thrown');
    } catch (e) {
      expect(e).to.be.ok;
    }
  });

  it('should throw error if path is invalid', () => {
    try {
      new FileStorageContext(339);
      expect.fail('Should have thrown');
    } catch (e) {
      expect(e).to.be.ok;
    }
  });

  it('should return defaultData if files does not exist', async () => {
    const ctx = new FileStorageContext(path.join(__dirname, './data.json'), { mergeWrites: true, defaultData: { foo: 'bar' } });
    const data = await ctx.read();
    expect(data).to.be.ok;
    expect(data.foo).to.be.ok;
    expect(data.foo).to.equal('bar');
  });

  it('should fallback to empty object if data is empty', async () => {
    const ctx = new FileStorageContext(path.join(__dirname, './data.json'));
    const data = await ctx.read();
    expect(data).to.be.ok;
    expect(JSON.stringify(data)).to.equal('{}');
  });

  it('should handle errors correctly when read permissions are denied', async () => {
    const filePath = path.join(__dirname, './data.json');

    mock({
      [filePath]: mock.file({
        content: 'file content here',
        mode: 0
      })
    });

    const ctx = new FileStorageContext(filePath, { mergeWrites: true, defaultData: { foo: 'bar' } });

    try {
      await ctx.read();
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err).to.be.ok;
    }
  });

  it('should read files correctly', async () => {
    const filePath = path.join(__dirname, './data.json');
    mock({
      [filePath]: '{ "application": "my-app" }'
    });

    const ctx = new FileStorageContext(filePath, { mergeWrites: true, defaultData: { foo: 'bar' } });
    const data = await ctx.read();
    expect(data).to.be.ok;
    expect(data.application).to.be.ok;
    expect(data.application).to.equal('my-app');
  });

  it('should return defaultData if file is empty', async () => {
    const filePath = path.join(__dirname, './data.json');
    mock({
      [filePath]: ''
    });

    const ctx = new FileStorageContext(filePath, { mergeWrites: true, defaultData: { foo: 'bar' } });
    const data = await ctx.read();
    expect(data).to.be.ok;
    expect(data.foo).to.be.ok;
    expect(data.foo).to.equal('bar');
  });

  it('should write files correctly', async () => {
    const filePath = path.join(__dirname, './data.json');
    mock({
      [filePath]: '{ "application": "my-app" }'
    });

    const ctx = new FileStorageContext(filePath);
    await ctx.write({ application: 'my-new-app' });
    const file = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    expect(file).to.be.ok;
    expect(file.application).to.be.ok;
    expect(file.application).to.equal('my-new-app');
  });

  it('should handle invalid json when reading the file', async () => {
    const filePath = path.join(__dirname, './data.json');
    mock({
      [filePath]: '{ application": "my-app" }'
    });

    const ctx = new FileStorageContext(filePath);
    try {
      await ctx.read();
      expect.fail('Should have thrown');
    } catch (e) {
      expect(e).to.be.ok;
    }
  });

  it('should merge objects if mergeWrites is true', async () => {
    const filePath = path.join(__dirname, './data.json');
    mock({
      [filePath]: '{ "application": "my-app" }'
    });

    const ctx = new FileStorageContext(filePath, { mergeWrites: true });
    await ctx.write({ version: '123' });
    const file = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    expect(file).to.be.ok;
    expect(file.application).to.be.ok;
    expect(file.application).to.equal('my-app');
    expect(file.version).to.be.ok;
    expect(file.version).to.equal('123');
  });

  it('should merge objects if mergeWrites is true and respect ordering', async () => {
    const filePath = path.join(__dirname, './data.json');
    mock({
      [filePath]: '{ "foo": "bar", "application": "my-app" }'
    });

    const ctx = new FileStorageContext(filePath, { mergeWrites: true });
    await ctx.write({ version: '123', application: 'my-new-app' });
    const file = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    expect(file).to.be.ok;
    expect(file.foo).to.be.ok;
    expect(file.foo).to.equal('bar');
    expect(file.application).to.be.ok;
    expect(file.application).to.equal('my-new-app');
    expect(file.version).to.be.ok;
    expect(file.version).to.equal('123');
  });

  it('should merge objects if mergeWrites is false', async () => {
    const filePath = path.join(__dirname, './data.json');
    mock({
      [filePath]: '{ "application": "my-app" }'
    });

    const ctx = new FileStorageContext(filePath, { mergeWrites: false });
    await ctx.write({ version: '123' });
    const file = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    expect(file).to.be.ok;
    expect(file.application).to.not.be.ok;
    expect(file.version).to.be.ok;
    expect(file.version).to.equal('123');
  });

  it('should handle errors correctly when writing problematic objects', async () => {
    const filePath = path.join(__dirname, './data.json');
    mock({
      [filePath]: mock.file({
        content: '{ "application": "my-app" }',
        mode: 256
      })
    });

    const a = { foo: 'bar' };
    const b = { bar: 'foo' };

    a.b = b;
    b.a = a;

    const ctx = new FileStorageContext(filePath, { mergeWrites: true });
    try {
      await ctx.write({ a: a, b: b });
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err).to.be.ok;
      expect(err.name).to.be.ok;
      expect(err.name).to.equal('TypeError');
    }
  });

  it('should handle errors correctly when write permissions are denied', async () => {
    // mock-fs and permissions seem to have issues when running in docker
    if (fs.existsSync('/.dockerenv')) {
      return;
    }

    const filePath = '/foo/bar.json';
    mock({
      [filePath]: mock.file({
        content: '{ "application": "my-app" }',
        mode: 256
      })
    });

    const ctx = new FileStorageContext(filePath, { mergeWrites: true });
    try {
      await ctx.write({ version: '123' });
      expect.fail('Should not write the file.');
    } catch (err) {
      expect(err).to.be.ok;
    }
  });
});
