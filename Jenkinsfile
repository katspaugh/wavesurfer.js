#!/bin/groovy

import com.animoto.*

def JenkinsType = new getJenkinsType()
def MyPod = new getExecutorPod().get(this)

pipeline {
  agent {
      kubernetes {
        inheritFrom MyPod.inheritFrom
        yaml MyPod.yaml
      }
  }
  options {
    disableConcurrentBuilds()
    timeout(time: 30, unit: 'MINUTES')
    skipStagesAfterUnstable()
  }
  stages {
    stage('build') {
      steps {
        withCredentials([
          usernamePassword(credentialsId: 'animoto-techops', usernameVariable: 'USERNAME', passwordVariable: 'JENKINS_TOKEN'),
          string(credentialsId: 'ANIMOTO_NPM_TOKEN', variable: 'ANIMOTO_NPM_TOKEN')]) {
        sh '''
          ao build
        '''
        }
      }
    }
    // stage('test') {
    //   when {
    //     not {
    //        expression {
    //         hasBumpVersion()
    //       }
    //     }
    //   }
    //   parallel {
    //     stage('linting') {
    //       steps {
    //         sh '''
    //           ao test -n lint
    //           '''
    //       }
    //       post {
    //         always {
    //           junit(allowEmptyResults: false, testResults: 'test_output/eslint/eslint.xml, test_output/stylelint.xml')
    //         }
    //       }
    //     }
    //     stage('unit tests') {
    //       steps {
    //         sh '''
    //           ao test -n test
    //           '''
    //       }
    //       post {
    //         always {
    //           junit(allowEmptyResults: false, testResults: 'test_output/jest/jest.xml')
    //         }
    //       }
    //     }
    //   }
    // }
    stage('version'){
      when {
        allOf {
          branch 'main'
          expression {
            shouldVersion() && JenkinsType.isJenkinsOperator() == true
          }
        }
      }
      steps {
        sh '''
          ao run -- yarn release
          '''
      }
    }
    stage('publish'){
      when {
        allOf {
          branch 'main'
          expression {
            hasBumpVersion() && JenkinsType.isJenkinsOperator() == true
          }
        }
      }
      steps {
        sh '''
          ao publish
          '''
      }
    }
  }
  post {
    always {
      // Notify the defined Slack channels of our build status
      withCredentials([string(credentialsId: 'slack_token', variable: 'slack_token')]) {
        script {
          def previous = (currentBuild.previousBuild != null) ? currentBuild.previousBuild.currentResult : "SUCCESS"
          sh "ao notify -c ${currentBuild.currentResult} -p ${previous}"
        }
      }
    }
  }
}

// Checks if commit message contains [bump version]
// The sh command returns:
// Returns 0 if [bump version] is found in the commit message
// Returns 1 if it is not found
def hasBumpVersion() {
  def BUMP_VERSION

  BUMP_VERSION = sh (
    script: """
      ao run -- "git log -1 | grep '.*\\[bump version\\].*'"
    """,
    returnStatus: true
  )

  return BUMP_VERSION == 0
}

// Checks if current local commit hash is the same as the latest origin commit hash
// The sh command returns:
// Returns 0 if local commit hash is the same as the latest origin commit hash
// Returns 1 if local commit hash is not the same as the latest origin commit hash
def isLatestCommit() {
  def IS_LATEST_MAIN

  IS_LATEST_MAIN = sh (
    script: """
      ao run \
       -v /get_main_hash.sh:/wavesurfer.js/get_main_hash.sh \
       -- /wavesurfer.js/get_main_hash.sh main
    """,
    returnStatus: true
  )

  return IS_LATEST_MAIN == 0
}

// Checks if the versioning step should be ran based on
// if the current commit is not a [bump version] commit and
// if current commit is latest origin main commit
// The sh command returns:
// Returns 0 if current local commit is not [bump version] commit and is latest origin commit
// Returns 1 if current local commit is [bump version] commit or is not the latest origin commit
def shouldVersion() {
  return !hasBumpVersion() && isLatestCommit()
}
