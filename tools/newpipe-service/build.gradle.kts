plugins {
    application
}

java {
    toolchain {
        languageVersion.set(JavaLanguageVersion.of(11))
    }
}

application {
    mainClass.set("msplayer.newpipe.NewPipeService")
}

dependencies {
    implementation("net.newpipe:extractor:v0.26.3")
}
