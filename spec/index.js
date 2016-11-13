var requireTest = require.context('./', true, /\.spec\.js$/);
requireTest.keys().forEach(requireTest);
