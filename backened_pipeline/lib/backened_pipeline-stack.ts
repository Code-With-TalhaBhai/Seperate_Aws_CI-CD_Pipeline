import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as codepipeline from 'aws-cdk-lib/aws-codepipeline';
import * as CodePipelineActions from 'aws-cdk-lib/aws-codepipeline-actions';
import * as codebuild from 'aws-cdk-lib/aws-codebuild'

// import * as sqs from 'aws-cdk-lib/aws-sqs';

export class BackenedPipelineStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);


    // Using CodeBuild(aws_service) to build repo of this project
    const cdkBuild = new codebuild.Project(this,'MyProject',{
      buildSpec: codebuild.BuildSpec.fromObject({
        version: '0.2',
        phases:{
          install:{
            "runtime-versions": {
              "nodejs": 16
            },
            commands:[
              'cd Your-repo-name',
              'cd Backened_CI-CD_Pipeline',
              'npm install'
            ]
          },
          build:{
            commands:[
              'npm run build',
              'npm run cdk synth --o - dist'
            ]
          },
          artifacts:{
            'base-directory': 'mygithub_repo/dist',
            files:[
              `${this.stackName}.template.json`
            ]
          },
          environment:{
            buildImage: codebuild.LinuxBuildImage.STANDARD_3_0
          }
          },
        })
      });


    // Artifact for Source Stage
    const sourceOutput = new codepipeline.Artifact();
    // Artifact for build Stage
    const buildOutput = new codepipeline.Artifact();



    // Creating a new pipeline
    const pipeline = new codepipeline.Pipeline(this,'mycodepipeline',{
      pipelineName: 'First-Custom-Pipeline',
      crossAccountKeys: false,
      restartExecutionOnUpdate: true
    });

    // Adding Stages to pipeline


    // First Stage to pipeline
    pipeline.addStage({
      stageName: 'Source_Stage',
      actions:[
        new CodePipelineActions.GitHubSourceAction({
          actionName: 'Github_source',
          owner: 'Code-With-TalhaBhai',
          repo: 'my-repo',
          oauthToken: cdk.SecretValue.secretsManager('Github_token'), // OAuth Secret store in AWS_Secret_Manager
          output: sourceOutput, // Fetches Repository from 'github' and stored in sourceOutput Artiface
          branch: 'Main'
        })
      ]
    });


    // Second build stage
    pipeline.addStage({
      stageName: 'Build_Stage',
      actions: [
        new CodePipelineActions.CodeBuildAction({
          actionName: 'Code_Build',
          project: cdkBuild,
          input: sourceOutput, // sourceOutput Artifact act as input in build stage as it contains raw code
          outputs: [buildOutput]
        })
      ]
    });


    pipeline.addStage({
      stageName: 'DeploymentStage',
      actions:[
        new CodePipelineActions.CloudFormationCreateUpdateStackAction({
          actionName: 'Deploy_Aws',
          stackName: this.stackName,
          templatePath: buildOutput.atPath(`${this.stackName}.template.json`),
          adminPermissions: true,
        })
      ]
    })
    
  }
}
