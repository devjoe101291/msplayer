pluginManagement {
    repositories {
        gradlePluginPortal()
        mavenCentral()
        google()
    }
}

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        mavenCentral()
        google()
        maven(url = "https://jitpack.io")
        maven {
            url = uri("../NewPipeExtractor/extractor/build/maven")
        }
    }
}

rootProject.name = "msplayer-newpipe-service"
