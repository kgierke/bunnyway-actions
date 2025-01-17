import { run } from './action';
import { jest } from '@jest/globals';
import * as core from '@actions/core';
import * as fs from 'fs/promises';
import * as Bunny from './bunny';

// Mock the necessary modules
jest.mock('@actions/core');
jest.mock('fs/promises');
jest.mock('./bunny');

describe('action', () => {
  const mockClient = {};
  // @ts-expect-error To fix
  const mockDeployScript = jest.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();

    // Mock core.getInput to return predefined values
    (core.getInput as jest.Mock<typeof core.getInput>).mockImplementation((input: string) => {
      switch (input) {
        case 'script_id':
          return "12345";
        case 'api_key':
          return "api_token";
        case 'deploy_key':
          return "private_token";
        case 'base':
          return "base_url";
        case 'file':
          return "/path/to/file";
        default:
          throw new Error('Unknown input');
      }
    });

    // Mock fs.readFile to return a file content
    (fs.readFile as jest.Mock<typeof fs.readFile>).mockResolvedValue('file content');

    // Mock Bunny.createClient to return a mock client
    (Bunny.createClient as jest.Mock).mockReturnValue(mockClient);

    // Mock Bunny.deployScript to return the mock deploy function
    (Bunny.deployScript as jest.Mock).mockReturnValue(mockDeployScript);

    // Mock Bunny.deployScript to return the mock deploy function
    (Bunny.newDeployKey as jest.Mock<typeof Bunny.newDeployKey>).mockImplementation((token: string) => ({
      _internal: "deploy",
      token,
    }));
  });

  test('should run the action successfully', async () => {
    await run();

    // Verify that inputs were fetched
    expect(core.getInput).toHaveBeenCalledWith('script_id', { required: true });
    expect(core.getInput).toHaveBeenCalledWith('deploy_key', { required: false });
    expect(core.getInput).toHaveBeenCalledWith('api_key', { required: false });
    expect(core.getInput).toHaveBeenCalledWith('file', { required: true });
    expect(core.getInput).toHaveBeenCalledWith('base', { required: false });

    // Verify that the client was created
    expect(Bunny.createClient).toHaveBeenCalledWith("base_url", { _internal: "deploy", token: "private_token" });

    // Verify that the file was read
    expect(fs.readFile).toHaveBeenCalledWith("/path/to/file", { encoding: "utf-8" });

    // Verify that the deployScript was called with correct parameters
    expect(Bunny.deployScript).toHaveBeenCalledWith(mockClient);
    expect(mockDeployScript).toHaveBeenCalledWith("12345", "file content");
  });

  test('should fail if reading the file fails', async () => {
    (fs.readFile as jest.Mock<typeof fs.readFile>).mockRejectedValue(new Error('File read error'));

    await run();

    // Verify that core.setFailed was called with the error message
    expect(core.setFailed).toHaveBeenCalledWith('File read error');
  });

  test('should fail if deploying the script fails', async () => {
    // @ts-expect-error To fix
    mockDeployScript.mockRejectedValue(new Error('Deployment error'));

    await run();

    // Verify that core.setFailed was called with the error message
    expect(core.setFailed).toHaveBeenCalledWith('Deployment error');
  });

  test('should fail if an unknown error occurs', async () => {
    (core.getInput as jest.Mock).mockImplementation(() => {
      throw new Error('Unknown error');
    });

    await run();

    // Verify that core.setFailed was called with the error message
    expect(core.setFailed).toHaveBeenCalledWith('Unknown error');
  });

  test('should throw if required inputs are missing', async () => {
    (core.getInput as jest.Mock<typeof core.getInput>).mockImplementation((input: string) => {
      if (input === 'file') throw new Error('Missing required input: file');
      return '';
    });

    await run();

    // Verify that core.setFailed was called with the error message
    expect(core.setFailed).toHaveBeenCalledWith('Missing required input: file');
  });
});
